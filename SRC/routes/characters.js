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