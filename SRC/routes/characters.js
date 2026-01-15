const {Router} = require("express");
const router = Router();


const allCharacter = [
    {
    "name": "Capitana Test",
            "class": "Hacker",
            "Life": 10,
            "isLife" : true
    },

    {
    "name": "Lololol",
            "class": "jajajajaj",
            "Life": 10000000000000,
            "isLife" : true
    }
]
router.get("/", (req, res) => {
    res.json(allCharacter[req.query.id]);
})


//quiero poner en el url lo siguiente y modificar el id y ir cambiando de pagina
//http://10.40.2.137:3000/characters/?id=0 -> capitana
//http://10.40.2.137:3000/characters/?id=1 -> lolollolo

router.get("/1", (req, res) => {
    const characters = {
        "name": "Capitana Test",
        "class": "Hacker",
        "Life": 10,
        "isLife" : true
    }

    res.json(characters);

});

router.get("/2", (req, res) => {
    const characters = {
        "name": "Lololol",
        "class": "jajajajaj",
        "Life": 10000000000000,
        "isLife" : true
    }

    res.json(characters);

});


module.exports = router;