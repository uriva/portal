import { connectWithAcking } from "./acking";
import { crypto } from "shared";

export const genKeyPair = crypto.genKeyPair;
export const connect = connectWithAcking;
