
let express = require('express');
var app = express();
let path = require('path');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
const cors = require('cors');
app.use(cors());
let indexRouter = require('./routes/index');
let autroutes = require('./routes/auth.routes');
 let sondageRoutes = require('./routes/sondageRoutes');
 let voteRoutes = require('./routes/voteRoutes');
  let dashboardRoutes = require('./routes/dashboardRoutes');

app.use('/', indexRouter);
app.use('/users', autroutes);
app.use('/sondage', sondageRoutes);
app.use('/vote', voteRoutes);
app.use('/dashboard', dashboardRoutes);
app.listen(3001, () => {
  console.log('Example app listening on port 3001!')
})
 
 
module.exports = app;  