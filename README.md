# Users-Posts System
A system to register user and manage his posts.

## Setup
1. Install node with latest LTS version and npm
```
$ sudo apt update
$ sudo apt install nodejs
$ sudo apt install npm 
```

2. Confirm the version of node and npm
```
$ nodejs -v
$ npm -v
```

3. Install serverless framework
```
$ sudo npm install -g serverless

```

4. Install dependencies in the project
```
$ sudo npm install
```

5. Refer the link to create the [AWS credentials](https://docs.aws.amazon.com/toolkit-for-eclipse/v1/user-guide/setup-credentials.html)

6. Setup AWS credentials 
```
$ export AWS_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
$ export AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxx
```
7. Deploy on your AWS platform
```
$ sls deploy
    OR
$ serverless deploy
```

## Endpoints Supported

1. [POST]  https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user/register: 
Save the data of user in database and sends the welcome mail to the email address.

2. [POST] https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user/login: 
Provide access token to use other APIs, user logs in using email and password only.

3. [GET] https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user/list: 
List all the users and their details

4. [GET] https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user:
Provides the details of the particular user

5. [PUT] https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user/{email}:
Update the user password

6. [DELETE]  https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user/{email}:
Delete the user

7. [POST] https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user/post:
User can post it's post

8. [GET] https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user/post/list: 
Fetched all the posts in the table

9. [GET] https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user/post/{id}:
Get the particular post

10. [PUT] https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user/post/{id}:
Update the particular post

11. [DELETE]  https://sb1rxs0fl8.execute-api.ap-south-1.amazonaws.com/dev/user/post/{id}:
Delete the particular post

## Note

1. Register the email in AWS if you are using trial AWS account to use SES service.

2. Postman Collection to try out the APIs- https://www.getpostman.com/collections/832e5a28ec482ffb87b0