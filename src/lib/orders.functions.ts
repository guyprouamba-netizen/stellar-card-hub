import { callApi } from "./api-client";

export const listOrders = (business_id: string, status?: string) =>
  callApi("listOrders", { business_id, status });
export const updateOrderStatus = (data: { id: string; status: string; merchant_note?: string }) =>
  callApi("updateOrderStatus", data);

export const listBusinessPosts = (business_id: string) =>
  callApi("listBusinessPosts", { business_id });
export const createBusinessPost = (data: {
  business_id: string; title: string; body?: string; image_url?: string; product_id?: string; published?: boolean;
}) => callApi("createBusinessPost", data);
export const updateBusinessPost = (data: { id: string; [k: string]: any }) =>
  callApi("updateBusinessPost", data);
export const deleteBusinessPost = (id: string) => callApi("deleteBusinessPost", { id });