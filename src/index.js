const express = require('express');
const mongoose = require('mongoose');
const File = require('./models/File');
const auth = require('./middleware/auth');
const path = require('path');
const { build } = require('joi');
require('dotenv').config();

const app = express();

mongoose.connect(
  process.env.DB_CONNECT,
  { useNewUrlParser: true, useUnifiedTopology: true },
  (err) => {
    if (err) {
      console.log({ msg: 'could not connect to database' });
    } else {
      app.listen(process.env.PORT, () => {
        console.log({ msg: `connected to database ${process.env.PORT}` });
        //insertData();
      });
    }
  }
);

app.use(express.json());
app.use('/api', auth, require('./routes/api'));
app.use(express.static(path.join(__dirname, 'build')));
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
