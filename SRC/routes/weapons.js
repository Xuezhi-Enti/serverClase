const {Router} = require("express");
const router = Router();

router.get("/allWeapons", (req, res) =>{

    const weapons = require("../statics/allWeapons.json");
    res.json(weapons);
})

router.get("/selectedWeapons", (req, res) =>{

    const weapons = require("../statics/allWeapons.json");
    res.json(weapons[req.query.id]);
})

module.exports = router;