import { connectWithAcking } from "./acking.ts";
import { crypto } from "../../common/src/index.ts";

export const generatePrivateKey = crypto.generatePrivateKey;
export const connect = connectWithAcking;
