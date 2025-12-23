const AfricasTalking = require('africastalking');

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME
});

module.exports = async (phone, message) => {
  await at.SMS.send({
    to: phone,
    message,
    from: 'KARUMANDE'
  });
};
