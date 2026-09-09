const jwt = require('jsonwebtoken');
const argon2 = require('argon2');

const User = require('../models/user');

const createToken = (userId) => jwt.sign(
  { userId },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }

    user = new User({ name, email, password });
    await user.save();

    const token = createToken(user._id);
    res.json({ token });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await argon2.verify(user.password, password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = createToken(user._id);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('_id name email')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

module.exports = { register, login, getUser };
