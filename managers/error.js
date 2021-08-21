/**
 * This Class can create an error
 * 
 * @params { String } message - the message of the error
 * @params { String } name - The name of the eror
 * 
 * @returns { Undefined }
 */

module.exports = class MiaDB extends Error {
  constructor(message, name = "MiaDB_Error") {
    super(message);
    this.name = name;
  };
};