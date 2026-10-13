# Commands

Create the project from the basic template, branch `22`:

```bash
composer create-project --prefer-dist --stability=dev yiisoft/yii2-app-basic:^22.0 blog
cd blog
```

Export the password, then apply the migrations shipped with the template:

```bash
export DB_PASSWORD='change-me'
./yii migrate --interactive=0
```
