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

>- to add project APP_URL, run `Laravel GoTo Controller` from the command palette.
>- popup will show both the route "uri & action"
>     - uri: will open the link in browser "if route is a **GET** && APP_URL was added"
>     - action: will open the controller file
>- routes auto completion

### Notes

- controller have to be following the [laravel convention](https://laravel.com/docs/6.x/controllers)
- `Closure` routes wont have a link
