import { callApi } from "./api-client";

export const updateMyProfile = (args: { data: { full_name?: string; avatar_url?: string; phone?: string } }) =>
  callApi("updateMyProfile", args.data);

export const updateMyPassword = (args: { data: { current_password: string; new_password: string } }) =>
  callApi("updateMyPassword", args.data);

export const createAvatarUploadUrl = (args: { data: { ext: string } }) =>
  callApi("createAvatarUploadUrl", args.data);

export const getAvatarSignedUrl = (args: { data: { path: string } }) =>
  callApi("getAvatarSignedUrl", args.data);