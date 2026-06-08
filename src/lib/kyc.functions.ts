import { callApi } from "./api-client";

export const submitFullKyc = (args: { data: any }) => callApi("submitFullKyc", args.data);
export const createKycUploadUrl = (args: { data: { kind: "id" | "selfie"; ext: string } }) => callApi("createKycUploadUrl", args.data);
