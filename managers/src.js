const raven = require("ravendb")
const Err = require("./error")

function getGoodKeyPath(str) {
  return str.match(/(\[("|'|`))?\w+(("|'|`)\])?/gm).map(e => e.match(/\[.+\]/g) ? e.slice(2, e.length-2) : e );
}

function updateObj(obj, path, value) {
  let object = obj;
  let last = path.pop();
  path.reduce((o, k) => o[k] = o[k] || {}, object)[last] = value;
  return object
}

function calc(old, nb, opt){
  if (typeof opt !== "string" || isNaN(old) || isNaN(nb)) return old;
  switch(opt){
    case "+": return old+nb;
    case "-": return old-nb;
    case "/": return old/nb;
    case "%": return old%nb;
    case "*": return old*nb;
    case "**": return old**nb;
    case "floor": return Math.floor(old);
    case "sqrt": return Math.sqrt(old);
    case "abs": return Math.abs(old);
    case "round": return Math.round(old);
    case "trunc": return Math.trunc(old);
    case "log": return Math.log(old);
    case "cos": return Math.cos(old);
    case "tan": return Math.tan(old);
    case "sin": return Math.sin(old);
  };
};

class MiaDB {
  constructor(options = {}){
      if (typeof options !== "object" || Array.isArray(options)) throw new Error("options must be an object", "options_type");
      if (typeof options.url !== "string") throw new Error("options.url must be a string", "option_url_type");
      if (typeof options.name !== "string") throw new Error("options.name must be a string", "option_name_type");
      this.store = new raven.DocumentStore(options.url, options.name);
      try { this.store.initialize() }
        catch(err) {
          this.store = null;
          throw new Error("The connextion has failed !\nTry to start the database or change the link and name in options")
        }
  };

  /**
   * 
   * @param {String} key - the key of the data
   * @param {*} data - the data for the key, it can be of any type !
   * @param {String|null} path - the path of the data, it's optionnal
   * @returns {*}
   */

   async set(key, data, path = null) {
    if (typeof key !== "string") throw new Error("key is not optionnal !");
    if (!this.store) throw new Error("An error as occured !");
    if (path && typeof path !== "string") throw new Error("invalid value was provided");
    let session = this.store.openSession();
    if (await session.load(key)) { // already exist
      let oldData = await session.load(key);
      if (!path) oldData.data = data;
      else { // access to the good path
        try { oldData.data = updateObj(oldData.data, getGoodKeyPath(path), data); }
          catch(err) { console.log(err); throw new Error("An invalid path was provided !") };
      };
    } else { // the key is create
      await session.store({ data: data }, key);
    };
    await session.saveChanges();
    return data;
  };

  /**
   * 
   * @param {String} key - the key of the dara
   * @param {*} path - the path in the key, it's optionnal
   * @returns {Boolean|*}
   */
   async get(key, path = null) {
    if (typeof key !== "string") throw new Error("key is not optionnal !");
    if (!this.store) throw new Error("An error as occured !");
    let session = this.store.openSession();
    try { 
      if (!path || (path && typeof path !== "string")) return (await session.load(key))?.data;
      let obj = (await session.load(key))?.data;
      getGoodKeyPath(path).forEach(elm => obj = obj[elm]);
      return obj;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  /**
   * This function create the key in the database if she doesn't exist
   * 
   * @param {String} key - the key 
   * @param {*} data - the data of the key if she doesn't existe
   * @returns {Boolean}
   */
  async ensure(key, data){
    if (typeof key !== "string") throw new Error("key is not optionnal !");
    if (!data) throw new Error("data is not optionnal !");
    if (!this.store) throw new Error("An error as occured !");
    const session = this.store.openSession();
    if (await session.load(key)) {
      return false;
    } else {
      await this.set(key, data);
      return true;
    };
  };

  /**
   * This function can check the existence of the key ( and the path if she have a path ) and return a boolean 
   * 
   * @param {String} key - the key wanted
   * @param {*} path - the path in the key if she exist, optionnal
   * @returns 
   */
  async has(key, path = null){
    if (!key || typeof key !== "string") throw new Error("key must be a string !");
    if (path && typeof path !== "string") throw new Error("path must be null or a string !");
    const session = await this.store.openSession();
    let data = (await session.load(key)).data;
    if (path) {
      // check if the key exist and if the path is good
      if (data) {
        // key exists, check the path
        try { getGoodKeyPath(path).forEach(elm => { data = data[elm] }); return true }
          catch(err) { return false }
      } else return false
    } else {
      if (data) return true;
      else return false;
    };
  };

  /**
   * This function delete a key
   * 
   * @param {String} key 
   * @returns {Boolean}
   */
  async delete(key){
    if (!key || typeof key !== "string") throw new Error("key must be a string !");
    const session = this.store.openSession();
    if ( !(await this.has(key)) ) return null;
    await session.delete(key);
    await session.saveChanges();
    return true;
  };

  /**
   * 
   * @param {String} key - the key
   * @param {String} path - the path where you want to increase, it's optionnal
   * @returns {Boolean}
   */
   async inc(key, path = null){
    if (path && typeof path !== "string") throw new Error("path must be a string or null");
    if (!key || typeof key !== "string") throw new Error("key must be a string");
    const session = await this.store.openSession()
    if (path){
      let data = await session.load(key)
      if (!data) return false;
      try {
        let oldData = data;
        ["data", ...getGoodKeyPath(path)].forEach(elm => oldData = oldData[elm]);
        oldData++
        data = updateObj(data, ["data", ...getGoodKeyPath(path)], oldData )
        await session.saveChanges()
        return true;
      } catch(err) { return null; }
    } else {
      let data = await session.load(key)
      if (!data) return false;
      data.data++
      await session.saveChanges()
      return true;
    }
  }


  /**
   * 
   * @param {String} key - the key
   * @param {String} path - the path where you want to decrease, it's optionnal
   * @returns {Boolean}
   */
   async dec(key, path = null){
    if (path && typeof path !== "string") throw new Error("path must be a string or null");
    if (!key || typeof key !== "string") throw new Error("key must be a string");
    const session = await this.store.openSession()
    if (path){
      let data = await session.load(key)
      if (!data) return false;
      try {
        let oldData = data;
        ["data", ...getGoodKeyPath(path)].forEach(elm => oldData = oldData[elm]);
        if (isNaN(oldData)) return null;
        oldData--
        data = updateObj(data, ["data", ...getGoodKeyPath(path)], oldData )
        await session.saveChanges()
        return true;
      } catch(err) { return null; }
    } else {
      let data = await session.load(key)
      if (!data) return false;
      if (isNaN(data.data)) return null;
      data.data--
      await session.saveChanges()
      return true;
    }
  };

  /**
   * 
   * @param {String} key - the key of the dara
   * @param {*} path - the path in the key, it's optionnal
   * @returns {Boolean|*}
   */
   async getPrimitive(key, path = null) {
    if (typeof key !== "string") throw new Error("key is not optionnal !");
    if (!this.store) throw new Error("An error as occured !");
    let session = await this.store.openSession();
    try { 
      if (!path || (path && typeof path !== "string")) return (await session.load(key));
      let obj = (await session.load(key));
      getGoodKeyPath(path).forEach(elm => obj = obj[elm]);
      return obj;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  /**
   * 
   * @param {String} key - the key of the data
   * @param {String} opt - the operator for the calc
   * @param {Number} data - the number for the operation, it's optionnal for some functions
   * @param {String} path - the path to the data, it's optionnal
   * @returns {Number}
   */
  async math(key, opt, data = 0, path = null){
    if (typeof key !== "string") throw new Error("key must be a string");
    if (typeof opt !== "string" || !["+","-","/","%","*", "**", "floor", "sqrt", "abs", "round", "trunc", "log", "cos", "tan", "sin"].includes(opt)) throw new Error("operator must be a string");
    if (isNaN(data)) throw new Error("data must be a number");
    if (path && typeof path !== "string") throw new Error("path must be a string");
    const session = await this.store.openSession();
    if ( !(await session.load(key)) ) return null;
    // path or not
    if (path){
      // path 
      let oldData = await session.load(key);
      let nb = (await session.load(key))?.data;
      getGoodKeyPath(path).forEach(elm => nb = nb[elm]);
      if (isNaN(nb)) return null;
      nb = calc(nb, data, opt);
      oldData = updateObj(oldData, ["data", ...getGoodKeyPath(path)], nb)
      await session.saveChanges()
      return true
    } else {
      // no path
      let oldData = await session.load(key);
      oldData.data = calc(oldData.data, data, opt)
      await session.saveChanges()
      return true
    }
  }

  /**
   * 
   * @param {String} key 
   * @param {*} data 
   * @param {String} path 
   * @param {Number} index 
   * @returns {Boolean}
   */
   async push(key, data, path = null, index = 0){
    if (typeof key !== "string") throw new Error("key must be a string");
    if (path && typeof path !== "string") throw new Error("path must be a string or null");
    if (isNaN(index)) throw new Error("index must be a number")
    const session = this.store.openSession()
    if ( !(await session.load(key)) ) return null;
    if (path) {
      // path
      let oldData = await session.load(key);
      let oldArr = await session.load(key);
      ["data", ...getGoodKeyPath(path)].forEach(elm => oldArr = oldArr[elm]);
      if (!Array.isArray(oldArr)) return null;
      oldArr.splice(index, 0, data);
      oldData = updateObj(oldData, getGoodKeyPath(path), oldArr)
      await session.saveChanges()
      return true;
    } else {
      // not path
      let oldData = await session.load(key);
      if (!Array.isArray(oldData.data)) return null;
      oldData["data"].splice(index, 0, data)
      await session.saveChanges()
      return true;
    }
  }



   async remove(key, path = null, index = 0, deleteCount = 1){
    if (typeof key !== "string") throw new Error("key must be a string");
    if (path && typeof path !== "string") throw new Error("path must be a string or null");
    if (isNaN(index)) throw new Error("index must be a number")
    if (isNaN(deleteCount)) throw new Error("deleteCount must be a number")
    const session = this.store.openSession()
    if ( !(await session.load(key)) ) return null;
    if (path) {
      // path
      let oldData = await session.load(key);
      let oldArr = await session.load(key);
      ["data", ...getGoodKeyPath(path)].forEach(elm => oldArr = oldArr[elm]);
      if (!Array.isArray(oldArr)) return null;
      oldArr.splice(index, deleteCount);
      oldData = updateObj(oldData, getGoodKeyPath(path), oldArr)
      await session.saveChanges()
      return true;
    } else {
      // not path
      let oldData = await session.load(key);
      if (!Array.isArray(oldData.data)) return null;
      oldData["data"].splice(index, deleteCount)
      await session.saveChanges()
      return true;
    }
  }

};

module.exports = MiaDB;