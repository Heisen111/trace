export interface TokenData {
  token: string;
  logprob: number;
  top_logprobs: { token: string; logprob: number }[];
}
