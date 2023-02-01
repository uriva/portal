import { connectWithAcking } from "./acking";
import { crypto } from "common";

export const genKeyPair = crypto.genKeyPair;
export const connect = connectWithAcking;
