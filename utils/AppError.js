export class AppError extends Error {
    constructor(message, statusCode = 500, code = null, meta = {}) {
        super(message);

        this.statusCode = statusCode;
        this.code = code;
        this.meta = meta; //  REQUIRED
        console.log("ERROR META:", this.meta);
      
    }
   
}
