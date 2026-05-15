with open('/Users/reunion/eM@g/apps/api/adminRoutes.js', 'r') as f:
    lines = f.readlines()

# Replace lines 145-146 (indices 144-145) with the correct code
# We want to remove the accidental app.post inside the block and the redundant lines.
# Looking at the previous output:
# 144:       // Alerte email aux admins
# 145:             app.post('/api/access-requests/check-email', async (req, res) => {
# 146: 
# 147:       res.json({

lines[144] = "      // Alerte email aux admins\n"
lines[145] = "\n"

with open('/Users/reunion/eM@g/apps/api/adminRoutes.js', 'w') as f:
    f.writelines(lines)
