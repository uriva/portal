import { connectWithAcking } from "./acking.ts";
import { crypto } from "../../common/src/index.ts";

export const genKeyPair = crypto.genKeyPair;
export const connect = connectWithAcking;
