let express = require('express');
var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

let indexRouter = require('./routes/index');
let usersRouter = require('./routes/users');

 



app.use('/', indexRouter);
app.use('/users', usersRouter);



module.exports = app;
