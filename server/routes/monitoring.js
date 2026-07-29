import { getPrisma } from '../services/database.js';
import { authenticate } from '../middleware/auth.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default async function monitoringRoutes(fastify) {
  fastify.get('/api/server/stats', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const latest = await prisma.serverStats.findFirst({ orderBy: { timestamp: 'desc' } });

    return reply.send({
      success: true,
      stats: latest || { message: 'Collecting data...' },
      collected: !!latest
    });
  });

  fastify.get('/api/server/stats/history', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const hours = parseInt(request.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const history = await prisma.serverStats.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
      take: 1000
    });

    return reply.send({
      success: true,
      history,
      from: since,
      to: new Date(),
      count: history.length
    });
  });

  fastify.get('/api/server/overview', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();

    const [totalProjects, activeProjects, totalDeployments, successfulDeployments, failedDeployments, latestStats, recentDeployments, latestProjects] = await Promise.all([
      prisma.project.count({ where: { deletedAt: null } }),
      prisma.project.count({ where: { deletedAt: null, status: 'active' } }),
      prisma.deployment.count(),
      prisma.deployment.count({ where: { status: 'success' } }),
      prisma.deployment.count({ where: { status: 'failed' } }),
      prisma.serverStats.findFirst({ orderBy: { timestamp: 'desc' } }),
      prisma.deployment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { project: { select: { name: true, slug: true } } }
      }),
      prisma.project.findMany({
        where: { deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, name: true, slug: true, status: true, lastDeployedAt: true }
      })
    ]);

    return reply.send({
      success: true,
      overview: {
        projects: { total: totalProjects, active: activeProjects },
        deployments: {
          total: totalDeployments,
          successful: successfulDeployments,
          failed: failedDeployments,
          successRate: totalDeployments > 0 ? ((successfulDeployments / totalDeployments) * 100).toFixed(1) : 100
        },
        server: latestStats ? {
          cpu: latestStats.cpu?.usage,
          memory: latestStats.memory?.used ? Math.round(latestStats.memory.used / 1024 / 1024) + 'MB' : null,
          uptime: latestStats.processes?.pm2Processes?.length || 0
        } : null,
        recentDeployments,
        latestProjects
      }
    });
  });

  fastify.post('/api/server/collect-stats', async (request, reply) => {
    const authToken = request.headers['x-internal-token'];
    if (authToken !== process.env.INTERNAL_TOKEN) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const os = await import('os');
      const { stdout: pm2Out } = await execPromise('pm2 jlist 2>/dev/null || echo "[]"').catch(() => ({ stdout: '[]' }));
      const { stdout: dfOut } = await execPromise('df -B1 / 2>/dev/null').catch(() => ({ stdout: '' }));

      let pm2Processes = [];
      try {
        pm2Processes = JSON.parse(pm2Out).map(p => ({
          name: p.name, pid: p.pid, cpu: p.monit?.cpu || 0, memory: p.monit?.memory || 0,
          status: p.pm2_env?.status || 'unknown', uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0, restarts: p.pm2_env?.restart_time || 0
        }));
      } catch (e) {}

      const dfLines = dfOut.split('\n').filter(l => l.trim());
      const diskInfo = dfLines.length > 1 ? dfLines[1].split(/\s+/) : [];

      const prisma = getPrisma();
      const stats = await prisma.serverStats.create({
        data: {
          timestamp: new Date(),
          cpu: {
            usage: os.loadavg()[0] / os.cpus().length * 100,
            loadAvg: os.loadavg(),
            cores: os.cpus().length
          },
          memory: {
            total: os.totalmem(),
            used: os.totalmem() - os.freemem(),
            free: os.freemem(),
            available: os.freemem()
          },
          disk: [{
            mount: '/',
            total: parseInt(diskInfo[1]) || 0,
            used: parseInt(diskInfo[2]) || 0,
            free: parseInt(diskInfo[3]) || 0,
            usage: parseInt(diskInfo[2]) && parseInt(diskInfo[1]) ? (parseInt(diskInfo[2]) / parseInt(diskInfo[1]) * 100) : 0
          }],
          processes: {
            total: pm2Processes.length,
            running: pm2Processes.filter(p => p.status === 'online').length,
            pm2Processes
          }
        }
      });

      return reply.send({ success: true, stats });
    } catch (err) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  fastify.get('/api/activity', { preHandler: [authenticate] }, async (request, reply) => {
    const prisma = getPrisma();
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 30;
    const skip = (page - 1) * limit;

    const where = { userId: request.user.id };
    if (request.query.projectId) where.projectId = request.query.projectId;
    if (request.query.category) where.category = request.query.category;

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { project: { select: { name: true, slug: true } } }
      }),
      prisma.activityLog.count({ where })
    ]);

    return reply.send({
      success: true,
      activities,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  });

  fastify.get('/api/server/frameworks', async (request, reply) => {
    return reply.send({
      success: true,
      frameworks: [
        { id: 'nextjs', name: 'Next.js', ports: [3000], commands: { install: 'npm install', build: 'npm run build', start: 'npm start' } },
        { id: 'vite', name: 'Vite / React', ports: [3000, 5173], commands: { install: 'npm install', build: 'npm run build', start: 'npx serve -s dist -l 3000' } },
        { id: 'express', name: 'Express.js', ports: [3000, 5000], commands: { install: 'npm install', build: '', start: 'npm start' } },
        { id: 'nestjs', name: 'NestJS', ports: [3000], commands: { install: 'npm install', build: 'npm run build', start: 'node dist/main' } },
        { id: 'django', name: 'Django', ports: [8000], commands: { install: 'pip install -r requirements.txt', build: 'python manage.py migrate', start: 'gunicorn --bind 0.0.0.0:8000 wsgi:application' } },
        { id: 'flask', name: 'Flask / FastAPI', ports: [5000], commands: { install: 'pip install -r requirements.txt', build: '', start: 'python app.py' } },
        { id: 'laravel', name: 'Laravel', ports: [8000], commands: { install: 'composer install --no-dev', build: 'php artisan config:cache', start: 'php artisan serve --port=8000' } },
        { id: 'docker', name: 'Docker Compose', ports: [3000, 8000, 5000], commands: { install: 'docker compose build', build: '', start: 'docker compose up -d' } },
        { id: 'static', name: 'Static HTML', ports: [80], commands: { install: '', build: '', start: 'npx serve -s . -l 80' } },
        { id: 'custom', name: 'Custom', ports: [3000], commands: { install: 'npm install', build: 'npm run build', start: 'npm start' } }
      ]
    });
  });
}
