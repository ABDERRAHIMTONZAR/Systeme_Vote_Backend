const mysql=require("mysql2")


const db=mysql.createConnection({
    host:"localhost",
    user:"root",
    password:"",
    database:"projetnode"
})
    
db.connect((err)=>{
     if(err){
        console.error(err);
     }
     console.log("Connexion Reussi")
})
module.exports=db