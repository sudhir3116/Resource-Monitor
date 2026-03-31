const bcrypt = require("bcryptjs");
const User = require("../models/User");

const seedUsers = async () => {
    try {
        const users = [
            { email: "admin@college.com", password: "Admin@123", role: "admin", name: "Admin" },
            { email: "gm@college.com", password: "gm@123", role: "gm", name: "GM" },
            { email: "warden@college.com", password: "warden@123", role: "warden", name: "Warden" },
            { email: "student@college.com", password: "student@123", role: "student", name: "Student" },
        ];

        for (const u of users) {
            const existing = await User.findOne({ email: u.email });

            if (!existing) {
                const hashed = await bcrypt.hash(u.password, 10);

                await User.create({
                    email: u.email,
                    password: hashed,
                    role: u.role,
                    name: u.name,
                    provider: 'local'
                });

                console.log(`✅ Created user: ${u.email}`);
            } else {
                console.log(`⚠️ User exists: ${u.email}`);
            }
        }

        console.log("✅ User seeding completed");
    } catch (err) {
        console.error("❌ Seeding error:", err);
    }
};

module.exports = seedUsers;
