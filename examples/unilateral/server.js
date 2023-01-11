import { cryptoPair, enroll, unilateral } from "portal";

unilateral.server({
  privateKey: "<serverPrivateKey>",
  onMessage: (message) => {
    console.log(message);
    return "this is a response from the server";
  },
});
