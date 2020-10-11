const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  console.log(req.path);
  const path = req.path.toString();
  if (
    path === '/signup' ||
    path === '/login' ||
    path === '/loginrecovery' ||
    path.startsWith('/verifyemail/')
  ) {
    return next();
  }

  try {
    const token = req.headers.authorization.split(' ');
    const tokenSecret =
      path === '/reset' ? process.env.EMAIL_SECRET : process.env.JWT_SECRET;
    const decodedToken = jwt.verify(token[1], tokenSecret);
    const dbUser = await User.findById(decodedToken._id);
    if (!dbUser) {
      throw 'id is invalid';
    }

    if (!dbUser.verified) {
      return res.status(400).json({ msg: 'please verfiy your account first' });
    }

    if (path === '/verify') {
      return res.json({ msg: 'valid user' });
    }

    if (path === '/reset') {
      if (decodedToken.iat * 1000 + decodedToken.expiresIn < Date.now()) {
        return res.status(400).json({ msg: 'password reset expired' });
      }
    }

    res.locals._id = decodedToken._id; //user exists
    return next();
  } catch (exception) {
    return res.status(401).json({ msg: 'invalid request' });
  }
};
