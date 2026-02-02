git pull
# Environment from command line
if [ -z "$1" ]
then
  target=production
else
  target=$1
fi
export APP_ENV=$target
# Region from command line
if [ -z "$2" ]
then
  region=$REGION
else
  region=$2
fi
export REGION=$region
echo "Deploying template-nextjs-please-rename in environment: " $APP_ENV " region: " $REGION
rm -rf ./.next
yarn
yarn build
if pm2 list | grep "\stemplate-nextjs-please-rename \s"
then
        echo "template-nextjs-please-rename process is present"
        pm2 list | grep "\stemplate-nextjs-please-rename \s" | awk '{print $2}' | xargs pm2 stop
        pm2 list | grep "\stemplate-nextjs-please-rename \s" | awk '{print $2}' | xargs pm2 delete
        pm2 reset template-nextjs-please-rename 
        if [ $target = "development" ]
        then
                CONFIG_OVERRIDE=development pm2 start "yarn start" --name template-nextjs-please-rename --update-env     
        else
                pm2 start "yarn start" --name template-nextjs-please-rename 
        fi
else
        echo "Setting up template-nextjs-please-rename process"
        if [ $target = "development" ]
        then
                CONFIG_OVERRIDE=development pm2 start "yarn start" --name template-nextjs-please-rename --update-env         
        else
                pm2 start "yarn start" --name template-nextjs-please-rename 
        fi
fi
pm2 save