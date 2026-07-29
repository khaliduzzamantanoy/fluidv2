#!/usr/bin/env bash
# fix-mongodb.sh - Fix MongoDB 8.0 auth + replica set keyFile issue
set -e

echo "Fixing MongoDB configuration..."

# Stop MongoDB
systemctl stop mongod 2>/dev/null || true
sleep 2

# Generate keyFile
openssl rand -base64 756 > /etc/mongodb-keyfile
chmod 400 /etc/mongodb-keyfile
chown mongodb:mongodb /etc/mongodb-keyfile

# Step 1: Start WITHOUT auth, init replica set, create user
echo "[1/4] Starting MongoDB without auth to initialize..."
cat > /etc/mongod.conf << 'CONF'
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
replication:
  replSetName: "rs0"
CONF

systemctl start mongod
sleep 3

# Init replica set
echo "[2/4] Initializing replica set..."
mongosh --quiet --eval 'rs.initiate({_id:"rs0", members:[{_id:0,host:"127.0.0.1:27017"}]})' 2>&1 || true
sleep 3

# Create admin user
echo "[3/4] Creating admin user..."
mongosh admin --quiet << 'EOF' 2>&1 || true
db.createUser({
  user: "fluid_admin",
  pwd: "FluidPortal2024!",
  roles: [{ role: "root", db: "admin" }]
});
EOF
sleep 1

# Step 2: Restart WITH auth + keyFile
echo "[4/4] Restarting MongoDB with authentication..."
systemctl stop mongod
sleep 2

cat > /etc/mongod.conf << 'CONF'
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
security:
  authorization: enabled
  keyFile: /etc/mongodb-keyfile
replication:
  replSetName: "rs0"
CONF

systemctl start mongod
sleep 3

# Step 3: Create fluid DB user (authenticated)
echo "Creating fluid database user..."
mongosh -u fluid_admin -p 'FluidPortal2024!' --authenticationDatabase admin fluid --quiet << 'EOF' 2>&1 || true
db.createUser({
  user: "fluid_admin",
  pwd: "FluidPortal2024!",
  roles: [{ role: "readWrite", db: "fluid" }, { role: "dbAdmin", db: "fluid" }]
});
EOF

# Verify
echo "Testing authenticated connection..."
if mongosh -u fluid_admin -p 'FluidPortal2024!' --authenticationDatabase admin --eval 'db.adminCommand("ping")' --quiet 2>/dev/null; then
  echo "MongoDB authentication working!"
else
  echo "WARNING: Auth check failed"
fi

# Update .env
cd /opt/fluid
if grep -q "MONGODB_URI" .env 2>/dev/null; then
  sed -i "s|^MONGODB_URI=.*|MONGODB_URI=mongodb://fluid_admin:FluidPortal2024!@127.0.0.1:27017/fluid?authSource=admin|" .env
else
  echo "MONGODB_URI=mongodb://fluid_admin:FluidPortal2024!@127.0.0.1:27017/fluid?authSource=admin" >> .env
fi

# Restart Fluid
systemctl restart fluid

echo ""
echo "============================================"
echo " MongoDB fixed! Portal should work now."
echo " http://146.190.103.85:6776"
echo "============================================"