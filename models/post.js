const mongoose = require('mongoose');
//Schema Setup
const postSchema = new mongoose.Schema({
    postId: {
        type: String,
        unique: true,
    },
    description: {
        type: String,
        default: ''
    },
    author: {
        type: String
    },
    imageURLs: [{
        type: String,
    }],
});

module.exports = mongoose.model("Post", postSchema);