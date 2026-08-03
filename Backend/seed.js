require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);
const userModel = require('./models/user.model');
const captainModel = require('./models/captain.model');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.DB_CONNECT);
        console.log('Connected to DB for seeding');

        // Clean existing test accounts
        await userModel.deleteMany({ email: 'testuser@test.com' });
        await captainModel.deleteMany({ email: 'testcaptain@test.com' });

        // Create Test User
        const userPassword = await userModel.hashPassword('password123');
        await userModel.create({
            fullname: { firstname: 'Test', lastname: 'User' },
            email: 'testuser@test.com',
            password: userPassword
        });
        console.log('Test User created: testuser@test.com / password123');

        // Create Test Captain
        const captainPassword = await captainModel.hashPassword('password123');
        await captainModel.create({
            fullname: { firstname: 'Test', lastname: 'Captain' },
            email: 'testcaptain@test.com',
            password: captainPassword,
            status: 'active',
            vehicle: {
                color: 'Black',
                plate: 'TEST-123',
                capacity: 4,
                vehicleType: 'car'
            },
            location: {
                ltd: -3.745,
                lng: -38.523
            }
        });
        console.log('Test Captain created: testcaptain@test.com / password123');

        mongoose.disconnect();
        console.log('Seeding complete. Disconnected.');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seed();
