const mongoose = require('mongoose');
//Schema Setup
const mapSchema = new mongoose.Schema({
    postLink: {
        type: String,
        unique: true,
    },
    Name: {
        type: String
    },
    description: {
        type: String
    },
    googleInfo: {
        type: String
    }

});

module.exports = mongoose.model("Map", mapSchema);