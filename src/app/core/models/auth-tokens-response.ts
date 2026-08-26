import { UserProfileResponse } from './user-profile-response';

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  user: UserProfileResponse;
}
