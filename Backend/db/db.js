const mongoose = require('mongoose');
const dns = require('dns');

// Override DNS servers to fix querySrv ECONNREFUSED on some networks
dns.setServers(['1.1.1.1', '8.8.8.8']);

function connectToDb() {
    mongoose.connect(process.env.MONGO_URI || process.env.DB_CONNECT
    ).then(() => {
        console.log('Connected to DB');
    }).catch(err => console.log(err));
}


module.exports = connectToDb;