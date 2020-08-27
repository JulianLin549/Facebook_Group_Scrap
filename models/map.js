const mongoose = require('mongoose');
//Schema Setup
const mapSchema = new mongoose.Schema({
    storeName: {
        type: String
    },
    region: {
        type: String
    },
    descriptionHTML: {
        type: String
    },
    descriptionText: {
        type: String
    },
    location: {
        type: {
            type: String,
            enum: ['Point'], // 'location.type' must be 'Point'
        },
        coordinates: {
            type: [Number],
            index: '2dsphere' //  [ '121.47718700000001', '25.02629050000002' ]  前lon後lat
        },
        formattedAddress: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }


});

module.exports = mongoose.model("Map", mapSchema);