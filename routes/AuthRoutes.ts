import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import {
    loginUser,
    logoutUser,
    registerUser,
    verifyUser,
} from "../controllers/AuthController.js";

import protect from "../middlewares/auth.js";

const AuthRouter = Router();

// Public routes
AuthRouter.post("/register", registerUser);
AuthRouter.post("/login", loginUser);

// Protected routes
AuthRouter.get("/verify", protect, verifyUser);
AuthRouter.post("/logout", protect, logoutUser);

export default AuthRouter;