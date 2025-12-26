let express=require('express')
var router = express.Router();
let authController=require('../controllers/auth.controller')

router.post('/create',authController.createUser);

router.post('/login',authController.loginUser);
router.post("/2fa/verify", authController.verify2fa);
router.post("/2fa/resend", authController.resend2fa);
module.exports = router;


 