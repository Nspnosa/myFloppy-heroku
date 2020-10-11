const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const File = require('../models/File');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');

require('dotenv').config();
const router = express.Router();

const signUpSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).required(),
  'last-name': Joi.string().min(2).required(),
});

async function sendConfirmationEmail(token, email, emailRecovery = false) {
  let transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.VERIFICATION_EMAIL,
      pass: process.env.VERIFICATION_PASS,
    },
  });
  // send mail with defined transport object
  const url = emailRecovery
    ? `http://${process.env.HOST}:${process.env.PORT_FRONT_END}/resetaccount/${token}`
    : `http://${process.env.HOST}:${process.env.PORT}/api/verifyemail/${token}`;

  const message = emailRecovery
    ? `Password recovery was requested, please visit <a href="${url}">this link</a>`
    : `Please verify your email by visiting <a href="${url}">this link</a>`;

  const subject = emailRecovery
    ? `MyFloppy password reset`
    : `MyFloppy email confirmation`;

  let info = await transporter.sendMail({
    from: '"mydiskwebapp" <mydiskwebapp@gmail.com>', // sender address
    to: email, // list of receivers
    subject: subject, // Subject line
    html: message, // html body
  });

  console.log(info);
  console.log('Message sent: %s', info.messageId);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

  // Preview only available when sending through an Ethereal account
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...t
}

router.post('/signup', async (req, res) => {
  const validationRes = signUpSchema.validate(req.body);

  if (validationRes.error) {
    return res
      .status(400)
      .json({ msg: validationRes.error.details[0].message });
  }

  const newUser = new User({
    email: req.body.email,
    name: req.body.name,
    'last-name': req.body['last-name'],
    password: bcrypt.hashSync(req.body.password, 10),
  });

  const emailExists = await User.findOne({ email: newUser.email });

  if (emailExists) {
    return res.status(400).json({ msg: 'email already registered' }); //email exists return error
  }

  await newUser.save(); //save to database
  sendConfirmationEmail(
    jwt.sign({ _id: newUser._id }, process.env.EMAIL_SECRET),
    newUser.email
  ).catch((error) => console.log(error));
  return res.json({ msg: 'user registered successfully' });
});

const logInSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

router.post('/login', async (req, res) => {
  try {
    const validationRes = logInSchema.validate(req.body);

    if (validationRes.error) {
      return res
        .status(400)
        .json({ msg: validationRes.error.details[0].message });
    }

    const userData = await User.findOne({ email: req.body.email });

    if (!userData) {
      return res.status(400).json({ msg: 'Unknown email' });
    }

    if (!bcrypt.compareSync(req.body.password, userData.password)) {
      return res.status(400).json({ msg: 'wrong password' });
    }
    const token = jwt.sign({ _id: userData._id }, process.env.JWT_SECRET);
    return res.json({ msg: 'login successful', token });
  } catch (error) {
    return res.status(500).json({ msg: 'could not authenticate user' });
  }
});

router.get('/data', async (req, res) => {
  console.log('inside data');
  try {
    const filesFound = await File.find(
      { owner: res.locals._id },
      { fileData: 0, owner: 0 }
    );
    if (!filesFound) {
      return res
        .status(400)
        .json({ msg: 'error, could not retrieve user data' });
    }
    return res.json({ files: filesFound });
  } catch {
    return res
      .status(500)
      .json({ msg: 'internal error looking retrieving data' });
  }
  //look for user information in database
});

router.put('/data/:id', async (req, res) => {
  try {
    console.log('inside put data');
    const fileFound = await File.findById(req.params.id, { fileData: 0 });

    if (!fileFound) {
      return res.status(400).json({ msg: 'error, could not retrieve data' });
    }

    console.log(fileFound);
    //verify user is owner
    if (fileFound.owner !== res.locals._id) {
      return res.status(403).json({ msg: 'error, access denied' });
    }

    // if (!req.body.name || !req.body.extension) {
    //   return res.status(400).json({ msg: 'no name or extension in body' });
    // }
    if (!req.body.name) {
      return res.status(400).json({ msg: 'no name in body' });
    }

    fileFound.name = req.body.name;
    await fileFound.save();
    return res.json({ msg: 'resource updated' });
  } catch {
    return res.status(500).json({ msg: 'internal error updating data' });
  }
  //look for user information in database
});

router.delete('/data/:id', async (req, res) => {
  try {
    console.log('inside delete data');
    const fileFound = await File.findById(req.params.id, { fileData: 0 });

    if (!fileFound) {
      return res.status(400).json({ msg: 'error, could not retrieve data' });
    }

    console.log(fileFound);
    //verify user is owner
    if (fileFound.owner !== res.locals._id) {
      return res.status(403).json({ msg: 'error, access denied' });
    }

    fileFound.name = req.body.name;

    //update user's used space
    // User.findOne({ _id: res.locals._id }, { usedSpace: 1 })
    //   .then((user) => {
    //     user.usedSpace = user.usedSpace - fileFound.size;
    //     return user.save();
    //   })
    //   .then();

    const userInfo = await User.findOne(
      { _id: res.locals._id },
      { usedSpace: 1 }
    );
    userInfo.usedSpace -= fileFound.size;
    await userInfo.save();
    await fileFound.remove();

    return res.json({ msg: 'resource updated' });
  } catch {
    return res.status(500).json({ msg: 'internal error updating data' });
  }
  //look for user information in database
});

/*const storage = multer.diskStorage({
  destination: './public/uploads',
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + '-' + Date.now() + path.extname(file.originalname)
    );
  },
});*/

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 1440 * 1024 },
}).single('file');

router.post('/data/upload', (req, res) => {
  upload(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ msg: err });
      }
      console.log(req);
      if (!req.file) {
        return res.status(400).json({ msg: 'no file uploaded' });
      }
      const userInfo = await User.findById(res.locals._id, {
        usedSpace: 1,
        assignedSpace: 1,
      });

      if (userInfo.usedSpace + req.file.size > userInfo.assignedSpace) {
        return res.status(400).json({ msg: 'user has not enough free space' });
      }
      userInfo.usedSpace += req.file.size;
      userInfo.save();
      const uploadedFileInfo = new File({
        owner: res.locals._id,
        name: req.file.originalname,
        'upload-date': Date.now(),
        size: req.file.size,
        fileData: JSON.stringify(req.file),
      });

      const uploadedFileInfoCpy = await uploadedFileInfo.save();

      if (uploadedFileInfoCpy !== uploadedFileInfo) {
        throw new Error('error saving to db');
      }

      return res.json({ msg: 'file uploaded correctly' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'could not upload file properly' });
    }
  });
});

router.get('/userinfo', async (req, res) => {
  try {
    const userInfo = await User.findById(res.locals._id, {
      usedSpace: 1,
      assignedSpace: 1,
      name: 1,
      _id: 0,
    });

    return res.json(userInfo);
  } catch (error) {
    return res
      .status(500)
      .json({ msg: 'internal error, could not get user info' });
  }
});

router.get('/data/:id', async (req, res) => {
  try {
    const fileFound = await File.findById(req.params.id, { fileData: 1 });
    if (!fileFound) {
      return res
        .status(400)
        .json({ msg: 'error, could not retrieve user data' });
    }

    const fileFoundObj = JSON.parse(fileFound.fileData);
    console.log(
      fileFoundObj.originalname,
      fileFoundObj.mimetype,
      fileFoundObj.encoding
    );
    res.setHeader(
      'content-disposition',
      `attachment; filename="${fileFoundObj.originalname}"`
    );
    res.setHeader('content-type', `${fileFoundObj.mimetype}`);
    res.setHeader('encoding', `${fileFoundObj.encoding}`);
    console.log(Buffer.from(fileFoundObj.buffer));
    res.end(Buffer.from(fileFoundObj.buffer.data) /*, fileFoundObj.encoding*/);
  } catch {
    return res
      .status(500)
      .json({ msg: 'internal error looking retrieving data' });
  }
  //look for user information in database
});

router.get('/verifyemail/:token', async (req, res) => {
  try {
    const url = `http://${process.env.HOST}:${process.env.PORT_FRONT_END}/login`;
    const decodedToken = jwt.verify(req.params.token, process.env.EMAIL_SECRET);
    const dbUser = await User.findById(decodedToken._id);
    console.log(decodedToken);
    console.log(dbUser);
    if (dbUser.verified) {
      return res.redirect(url);
    }

    dbUser.verified = true;
    dbUser.save();
    return res.redirect(url);
  } catch {
    return res.status(400).json({ msg: 'invalid request to verify email' });
  }
});

router.post('/loginrecovery', async (req, res) => {
  console.log(req);
  try {
    const email = req.body.email;
    const dbUser = await User.findOne({ email });
    if (!dbUser) {
      return res.status(400).json({ msg: 'invalid email address' });
    }
    console.log('user exists');
    if (!dbUser.verified) {
      return res.status(400).json({ msg: 'user has not been verified yet' });
    }

    console.log('user verified');
    const token = jwt.sign(
      { _id: dbUser._id, expiresIn: 2 * 1000 * 60 },
      process.env.EMAIL_SECRET
    );
    console.log(token);
    sendConfirmationEmail(token, dbUser.email, true);

    return res.json({ msg: `Recovery email sent to ${email}` });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ msg: 'internal error generating recovery data' });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const url = `http://${process.env.HOST}:${process.env.PORT_FRONT_END}/login`;
    const dbUser = await User.findById(res.locals._id, { password: 1 });
    dbUser.password = bcrypt.hashSync(req.body.password, 10);
    await dbUser.save();
    console.log();
    return res.json({ msg: 'password reset' });
  } catch {
    return res.status(400).json({ msg: 'invalid request to reset password' });
  }
});

module.exports = router;
