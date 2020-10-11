const { number } = require('joi');
const mongoose = require('mongoose');

const UserSchema = mongoose.Schema({
  name: {
    require: true,
    type: String,
  },
  'last-name': {
    require: true,
    type: String,
  },
  email: {
    require: true,
    type: String,
  },
  password: {
    require: true,
    type: String,
  },
  assignedSpace: {
    require: true,
    type: Number,
    default: 1440 * 1024,
  },
  usedSpace: {
    require: true,
    type: Number,
    default: 0,
  },
  verified: {
    required: true,
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('User', UserSchema);
