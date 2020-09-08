# Laravel Goto Controller

- project have to be handled by **Composer**

## Features

- Controller

>- add method/action to clipboard if not found in controller ex."used through a trait"
>- supports controller definitions like
>     - `Something\PhotoController`
>     - `PhotoController`
>     - `PhotoController@index`

- Routes

>- to add project **APP_URL**, run `Laravel GoTo Controller` from the command palette.
>- popup will show both the route "uri & action"
>     - uri: will open the link in browser "if route is a **GET** && **APP_URL** was added"
>     - action: will open the controller file
>- routes auto completion

### Notes

- controller have to be following the [laravel convention](https://laravel.com/docs/master/controllers)
- `Closure` routes wont have a link
- in order for controller link to redirect to the correct place, make sure the `terminal.integrated.scrollback` is set to big number ex.`10000` or even more if you have a very long list, otherwise you might get redirected to wrong controller.
