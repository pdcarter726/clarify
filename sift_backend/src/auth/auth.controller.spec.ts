import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { signup: jest.Mock; login: jest.Mock };

  beforeEach(() => {
    authService = { signup: jest.fn(), login: jest.fn() };
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('signup delegates to AuthService.signup', () => {
    const dto = { email: 'a@b.com', password: 'password1' };
    controller.signup(dto);
    expect(authService.signup).toHaveBeenCalledWith(dto);
  });

  it('login delegates to AuthService.login', () => {
    const dto = { email: 'a@b.com', password: 'password1' };
    controller.login(dto);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('me returns the request user set by JwtStrategy', () => {
    const req = { user: { userId: 1, email: 'a@b.com' } };
    const result = controller.me(req as any);
    expect(result).toEqual({ userId: 1, email: 'a@b.com' });
  });
});
