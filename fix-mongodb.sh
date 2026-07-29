#!/usr/bin/env bash
# fix-mongodb.sh - Fix MongoDB 8.0 auth + replica set keyFile issue
set -e

echo "Fixing MongoDB configuration..."

# Stop MongoDB if running
systemctl stop mongod 2>/dev/null || true
sleep 1

# Generate keyFile
openssl rand -base64 756 > /etc/mongodb-keyfile
chmod 400 /etc/mongodb-keyfile
chown mongodb:mongodb /etc/mongodb-keyfile

# Write clean config with proper auth + keyFile for replica set
cat > /etc/mongod.conf << 'CONF'
# mongod.conf
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

# Start MongoDB
systemctl start mongod
echo "Waiting for MongoDB to be ready..."
for i in {1..15}; do
  if mongosh --quiet --eval 'db.adminCommand("ping")' 2>/dev/null; then
    echo "MongoDB is ready!"
    break
  fi
  sleep 2
done

# Check if replica set is initialized
if ! mongosh --quiet --eval 'rs.status().ok' 2>/dev/null; then
  echo "Initializing replica set..."
  mongosh --quiet --eval 'rs.initiate({_id:"rs0", members:[{_id:0,host:"127.0.0.1:27017"}]})'
  sleep 3
fi

# Create admin user (via localhost exception)
echo "Creating database users..."
mongosh admin --quiet << 'EOF'
db.getUsers().forEach(u => { if(u.user === "fluid_admin") db.dropUser("fluid_admin") });
db.createUser({
  user: "fluid_admin",
  pwd: "FluidPortal2024!",
  roles: [{ role: "root", db: "admin" }]
});
EOF

mongosh fluid --quiet << 'EOF'
db.getUsers().forEach(u => { if(u.user === "fluid_admin") db.dropUser("fluid_admin") });
db.createUser({
  user: "fluid_admin",
  pwd: "FluidPortal2024!",
  roles: [{ role: "readWrite", db: "fluid" }, { role: "dbAdmin", db: "fluid" }]
});
EOF

# Verify auth works
echo "Testing authenticated connection..."
mongosh -u fluid_admin -p 'FluidPortal2024!' --authenticationDatabase admin --eval 'db.adminCommand("ping")' --quiet

# Update .env
cd /opt/fluid
if grep -q "MONGODB_URI" .env; then
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