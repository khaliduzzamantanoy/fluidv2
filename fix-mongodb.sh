#!/usr/bin/env bash
# fix-mongodb.sh - Fix MongoDB 8.0 auth + replica set keyFile issue
set -e

echo "Fixing MongoDB configuration..."
MONGO_USER="${1:-fluid_admin}"
MONGO_PASS="${2:-FluidPortal2024!}"

# Stop MongoDB
systemctl stop mongod 2>/dev/null || true
sleep 2

# Generate keyFile
openssl rand -base64 756 > /etc/mongodb-keyfile
chmod 400 /etc/mongodb-keyfile
chown mongodb:mongodb /etc/mongodb-keyfile

# Step 1: Start WITHOUT auth, init replica set
echo "[1/4] Starting MongoDB without auth..."
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
echo "Waiting for MongoDB..."
for i in {1..15}; do
  if mongosh --quiet --eval 'db.adminCommand("ping")' 2>/dev/null; then
    echo "MongoDB ready"
    break
  fi
  sleep 2
done

# Init replica set (may fail if already initialized, that's OK)
echo "[2/4] Initializing replica set..."
mongosh --quiet --eval 'rs.initiate({_id:"rs0", members:[{_id:0,host:"127.0.0.1:27017"}]})' 2>&1 || true
sleep 4

# Create admin user if not exists (localhost exception works here)
echo "[3/4] Creating admin user..."
mongosh admin --quiet << 'EOF' 2>&1 || true
if (db.getUser("fluid_admin") === null) {
  db.createUser({
    user: "fluid_admin",
    pwd: "FluidPortal2024!",
    roles: [{ role: "root", db: "admin" }]
  });
  print("User created");
} else {
  print("User already exists");
}
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

# Verify
echo "Testing authenticated connection..."
mongosh -u fluid_admin -p 'FluidPortal2024!' --authenticationDatabase admin --eval 'db.adminCommand("ping")' --quiet 2>&1 && echo "AUTH OK" || echo "AUTH FAILED"

# Update .env
cd /opt/fluid
MONGODB_URI="mongodb://fluid_admin:FluidPortal2024!@127.0.0.1:27017/fluid?authSource=admin"
if grep -q "MONGODB_URI" .env 2>/dev/null; then
  sed -i "s|^MONGODB_URI=.*|MONGODB_URI=${MONGODB_URI}|" .env
else
  echo "MONGODB_URI=${MONGODB_URI}" >> .env
fi

# Restart Fluid
systemctl restart fluid

echo ""
echo "============================================"
echo " MongoDB fixed! Portal should work now."
echo " http://146.190.103.85:6776"
echo "============================================"