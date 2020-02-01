# Laravel Goto Controller

- project have to be handled by **Composer**

## Controller

- controller have to be following the [laravel convention](https://laravel.com/docs/6.x/controllers)
- supports controller definitions like
    - `Something\PhotoController`
    - `PhotoController`
    - `PhotoController@index`

## Routes

- `Closure` routes wont have a link
- to add project APP_URL, run `Laravel GoTo Controller` command from the command palette.
- popup will show both the route "uri & action"
    - uri: will open the link in browser "if route is a **GET** && APP_URL was added"
    - action: will open the controller file
