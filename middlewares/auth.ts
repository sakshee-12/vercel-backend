// import {Request,Response,NextFunction} from 'express';

// const protect = async (req:Request, res:Response, next:NextFunction)=>{
//     const {isLoggedIn, userId} = req.session;
//     if(!isLoggedIn || !userId){
//         return res.status(401).json({message:'you are not logged in'});
//     }
//     next()
// }
// export default protect

import { Request, Response, NextFunction } from "express";

const protect = (req: Request, res: Response, next: NextFunction) => {
  // ✅ safe access
  if (!req.session || !req.session.isLoggedIn || !req.session.userId) {
    return res.status(401).json({ message: "You are not logged in" });
  }

  next();
};

export default protect;
