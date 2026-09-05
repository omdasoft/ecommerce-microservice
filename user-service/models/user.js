const mongoose = require('mongoose');
const argon2 = require('argon2');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
}, { timestamps: true });   


userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    this.password = await argon2.hash(this.password);
});

module.exports = mongoose.model('User', userSchema);