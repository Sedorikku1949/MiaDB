module.exports = async function(){
  const db = require("./managers/src.js");

  const store = (new db({ name: "test", url: "http://127.0.0.1:8080"}));

  class toiTuNeBugPas {
    constructor(){
      this.hello = { ara: [1,2,3,4,5,6,7,8,9] }
    }
  }
  console.log("get user/sed :")
  console.log(await store.get("user/sed"))

  console.log("set user/sed :")
  console.log(await store.set("user/sed", { hello: { ara: true }}))

  console.log("get user/sed :")
  console.log(await store.get("user/sed"))
}