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
 


app.use('/', indexRouter);
app.use('/users', autroutes);
app.use('/sondage', sondageRoutes);
app.listen(3001, () => {
  console.log('Example app listening on port 3001!')
})


module.exports = app;  
