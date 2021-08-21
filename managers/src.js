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

class MiaDB {
  constructor(options = {}){
      if (typeof options !== "object" || Array.isArray(options)) throw new Error("options must be an object", "options_type");
      if (typeof options.url !== "string") throw new Error("options.url must be a string", "option_url_type");
      if (typeof options.name !== "string") throw new Error("options.name must be a string", "option_name_type");
      this.store = new raven.DocumentStore(options.url, options.name);
      this.store.initialize()
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
    await session.saveChanges()
    return true
  }
};

module.exports = MiaDB;