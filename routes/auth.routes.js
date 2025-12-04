let express=require('express')
var router = express.Router();
let authController=require('../controllers/auth.controller')

router.post('/create',authController.createUser);

router.post('/login',authController.loginUser);

module.exports = router;


 