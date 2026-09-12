import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { findOne: jest.Mock; update: jest.Mock; remove: jest.Mock };

  beforeEach(() => {
    usersService = { findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };
    controller = new UsersController(usersService as unknown as UsersService);
  });

  it('findMe delegates to UsersService.findOne with the current user id', () => {
    controller.findMe(7);
    expect(usersService.findOne).toHaveBeenCalledWith(7);
  });

  it('updateMe delegates to UsersService.update with the current user id and dto', () => {
    const dto = { currentPassword: 'password1', email: 'new@b.com' };
    controller.updateMe(7, dto);
    expect(usersService.update).toHaveBeenCalledWith(7, dto);
  });

  it('removeMe delegates to UsersService.remove with the current user id and currentPassword', () => {
    controller.removeMe(7, { currentPassword: 'password1' });
    expect(usersService.remove).toHaveBeenCalledWith(7, 'password1');
  });
});
