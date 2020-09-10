'use strict';
const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
const { v4: uuidv4 } = require('uuid');
const Cryptr = require('cryptr');
const cryptr = new Cryptr('myTotalySecretKey');
const postsTable = process.env.POSTS_TABLE;
const usersTable = process.env.USERS_TABLE;
const SES = new AWS.SES();
require('dotenv').config()
var jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET

// Create a response
function response(statusCode, message) {
  return {
    statusCode: statusCode,
    body: JSON.stringify(message)
  };
}

// SES integration
var sendEmail = (email) => {
  return new Promise(function (resolve, reject) {
    const params = {
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Body: {
          Text: { Data: "Welcome, your are successfully registered. Use /user/login api to get access token and use other APIs." },
        },
        Subject: { Data: "Registered with algoworks" },
      },
      Source: process.env.EMAIL,
    };

    try {
      SES.sendEmail(params).promise().then(() => {
        resolve('Registered and email sent successfully');
      })
    } catch (error) {
      resolve('The email failed to send');
    }
  })

};

function authentication(request) {
  return new Promise(function (resolve) {
    let resp = {}
    const token = request.headers['Authorization'];
    if (!token) {
      resp.statusCode = 401;
      resp.message = 'No token provided.';
      resolve(resp);
    }
    jwt.verify(token, secret, function (err, decoded) {
      if (err) {
        resp.statusCode = 401;
        resp.message = 'Failed to authenticate token';
        resolve(resp);
      } else {
        resp.statusCode = 200;
        resp.message = decoded;
        resolve(resp);
      }

    })
  })
}

// Register User API
module.exports.registerUser = (event, context, callback) => {
  const reqBody = JSON.parse(event.body);
  if (
    !reqBody.name ||
    reqBody.name.trim() === '' ||
    !reqBody.email ||
    reqBody.email.trim() === '' ||
    !reqBody.phone ||
    reqBody.phone.trim() === '' ||
    !reqBody.password ||
    reqBody.password.trim() === '' ||
    !reqBody.gender ||
    reqBody.gender.trim() === ''
  ) {
    return callback(
      null,
      response(400, {
        error: 'Register must have name, email, phone, password and gender'
      })
    );
  }

  // Password Encryption
  const encryptedString = cryptr.encrypt(reqBody.password);
  const params = {
    Key: {
      email: reqBody.email
    },
    TableName: usersTable
  };

  return db
    .get(params)
    .promise()
    .then((res) => {
      if (res.Item) callback(null, response(200, { message: 'You are already registered, please hit /users/login' }));
      else {
        const post = {
          name: reqBody.name,
          email: reqBody.email,
          phone: reqBody.phone,
          password: encryptedString,
          gender: reqBody.gender
        };
        return db
          .put({
            TableName: usersTable,
            Item: post
          })
          .promise()
          .then(async () => {
            const mesg = await sendEmail(reqBody.email)

            callback(null, response(200, { message: mesg }));

          })
          .catch((err) => callback(null, response(err.statusCode, err)));
      }
    }).catch((err) => callback(null, response(err.statusCode, err)));
};

// User login, provides token
module.exports.loginUser = (event, context, callback) => {
  const reqBody = JSON.parse(event.body);

  if (
    !reqBody.email ||
    reqBody.email.trim() === '' ||
    !reqBody.password ||
    reqBody.password.trim() === ''
  ) {
    return callback(
      null,
      response(400, {
        error: 'Login must have email and password'
      })
    );
  }

  const params = {
    Key: {
      email: reqBody.email
    },
    TableName: usersTable
  };

  return db
    .get(params)
    .promise()
    .then((res) => {
      if (res.Item) {
        if (reqBody.password === cryptr.decrypt(res.Item.password)) {
          const token = jwt.sign({ email: reqBody.email }, secret, {
            expiresIn: 3600 // expires in 1 hour
          });
          const mesg = {
            message: "Hurray, you are logged in, use the token for further APIs",
            token: token
          }
          callback(null, response(200, { message: mesg }))
        } else {
          callback(null, response(404, { message: 'Login failed! Please, enter the correct password ' }))
        }
      }
      else {
        callback(null, response(404, { message: 'Please, register yourself using /users/register endpoint ' }))
      }
    }).catch((err) => callback(null, response(err.statusCode, err)));
};

// Get All Users
module.exports.listUsers = async (event, context, callback) => {
  const resp = await authentication(event)
  if (resp.statusCode == 200) {
    return db
      .scan({
        TableName: usersTable
      })
      .promise()
      .then((res) => {
        callback(null, response(200, res.Items));
      })
      .catch((err) => callback(null, response(err.statusCode, err)));
  } else {
    return callback(null, response(resp.statusCode, resp.message));
  }
}

// Get a user by email
module.exports.getUser = async (event, context, callback) => {
  const email = event.pathParameters.email;
  const resp = await authentication(event);
  if (resp.statusCode == 200) {
    const params = {
      Key: {
        email: email
      },
      TableName: usersTable
    };

    return db.get(params).promise().then((res) => {
      if (res.Item) callback(null, response(200, res.Item));
      else callback(null, response(404, { error: 'User details not found' }));
    }).catch((err) => {
      callback(null, response(err.statusCode, err));
    })
  } else {
    return callback(null, response(resp.statusCode, resp.message));
  }
};

// Update a user's password 
module.exports.updateUser = async (event, context, callback) => {
  if (!event.pathParameters.email) {
    return callback(400, { message: "Enter the email in params" })
  }
  const email = event.pathParameters.email;
  const reqBody = JSON.parse(event.body);
  const { password } = reqBody;
  if (
    !password
  ) {
    return callback(
      null,
      response(400, {
        error: 'Enter the password to be updated'
      })
    );
  }
  const newpassword = cryptr.encrypt(password);
  const resp = await authentication(event);
  if (resp.statusCode == 200) {
    const params = {
      Key: {
        email: email
      },
      TableName: usersTable,
      ConditionExpression: 'attribute_exists(email)',
      UpdateExpression: 'SET password = :password',
      ExpressionAttributeValues: {
        ':password': newpassword
      },
      ReturnValues: 'ALL_NEW'
    };

    return db
      .update(params)
      .promise()
      .then((res) => {
        callback(null, response(200, { message: 'The password is updated' }));
      })
      .catch((err) => callback(null, response(err.statusCode, err)));
  } else {
    return callback(null, response(resp.statusCode, { message: resp.message }));
  }
};

// Delete a user
module.exports.deleteUser = async (event, context, callback) => {
  const email = event.pathParameters.email;
  const resp = await authentication(event);
  const params = {
    Key: {
      email: email
    },
    TableName: usersTable
  };

  if (resp.statusCode == 200) {
    return db
      .delete(params)
      .promise()
      .then(() =>
        callback(null, response(200, { message: 'User deleted successfully' }))
      )
      .catch((err) => callback(null, response(err.statusCode, err)));
  } else {
    return callback(null, response(resp.statusCode, { message: resp.message }));
  }

};

// Creating User post
module.exports.createPost = async (event, context, callback) => {
  const reqBody = JSON.parse(event.body);
  const resp = await authentication(event);
  if (
    !reqBody.post ||
    reqBody.post.trim() === ""
  ) {
    return callback(
      null,
      response(400, {
        error: 'There is nothing to post'
      })
    );
  }

  if (resp.statusCode == 200) {
    const post = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      email: resp.message.email,
      post: reqBody.post
    };

    return db
      .put({
        TableName: postsTable,
        Item: post
      })
      .promise()
      .then(() => {
        callback(null, response(201, post));
      })
      .catch((err) => response(null, response(err.statusCode, err)));
  } else {
    return callback(null, response(resp.statusCode, { message: resp.message }));
  }

};

// Get all posts
module.exports.getAllPosts = async (event, context, callback) => {
  const resp = await authentication(event);
  if (resp.statusCode == 200) {
    return db
      .scan({
        TableName: postsTable
      })
      .promise()
      .then((res) => {
        callback(null, response(200, res.Items));
      })
      .catch((err) => callback(null, response(err.statusCode, err)));
  } else {
    return callback(null, response(resp.statusCode, { message: resp.message }));
  }
};

// Get details about the user post
module.exports.getPost = async (event, context, callback) => {
  if (!event.pathParameters.id) {
    return callback(400, { message: "Enter the post id in params" })
  }
  const id = event.pathParameters.id;
  const resp = await authentication(event);
  if (resp.statusCode == 200) {
    const params = {
      Key: {
        email: resp.message.email,
        id: id
      },
      TableName: postsTable
    };

    return db
      .get(params)
      .promise()
      .then((res) => {
        if (res.Item) callback(null, response(200, res.Item));
        else callback(null, response(404, { error: 'Post not found' }));
      })
      .catch((err) => callback(null, response(err.statusCode, err)));
  } else {
    return callback(null, response(resp.statusCode, { message: resp.message }));
  }
};

// Update a post
module.exports.updatePost = async (event, context, callback) => {
  if (!event.pathParameters.id) {
    return callback(400, { message: "Enter the post id in params" })
  }
  const id = event.pathParameters.id;
  const reqBody = JSON.parse(event.body);
  const { post } = reqBody;
  if (
    !reqBody.post
  ) {
    return callback(
      null,
      response(400, {
        error: 'Enter the post to be updated'
      })
    );
  }

  const resp = await authentication(event);
  if (resp.statusCode == 200) {
    const params = {
      Key: {
        id: id,
        email: resp.message.email
      },
      TableName: postsTable,
      ConditionExpression: 'attribute_exists(id)',
      UpdateExpression: 'SET post = :post',
      ExpressionAttributeValues: {
        ':post': reqBody.post
      },
      ReturnValues: 'ALL_NEW'
    };

    return db
      .update(params)
      .promise()
      .then((res) => {
        callback(null, response(200, res.Attributes));
      })
      .catch((err) => callback(null, response(err.statusCode, err)));
  } else {
    return callback(null, response(resp.statusCode, { message: resp.message }));
  }
};

// Delete a post
module.exports.deletePost = async (event, context, callback) => {
  if (!event.pathParameters.id) {
    return callback(null, response(400, { message: "Enter the post id in params" }));
  }
  const id = event.pathParameters.id;
  const resp = await authentication(event);
  if (resp.statusCode == 200) {
    const params = {
      Key: {
        email: resp.message.email,
        id: id
      },
      TableName: postsTable
    };
    return db
      .delete(params)
      .promise()
      .then(() =>
        callback(null, response(200, { message: 'Post deleted successfully' }))
      )
      .catch((err) => callback(null, response(err.statusCode, err)));
  } else {
    return callback(null, response(resp.statusCode, { message: resp.message }));
  }
};
